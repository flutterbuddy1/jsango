import type {
  ColumnDefinition,
  ColumnType,
  ForeignKeyDefinition,
  IndexDefinition,
  TableDefinition,
  UniqueConstraintDefinition,
} from '../public/types.js';
import {
  AddColumnOperation,
  AddForeignKeyOperation,
  AlterColumnOperation,
  CreateIndexOperation,
  CreateTableOperation,
  CreateUniqueConstraintOperation,
  DropColumnOperation,
  DropForeignKeyOperation,
  DropIndexOperation,
  DropTableOperation,
  DropUniqueConstraintOperation,
  type MigrationOperation,
  RawSqlOperation,
  RenameColumnOperation,
  RenameTableOperation,
} from '../public/operations.js';
import { MigrationError } from '../public/errors.js';

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type MigrationDialect = 'postgres' | 'sqlite' | 'mysql' | 'mongodb' | 'memory';

/**
 * Maps a driver name ('pg', 'postgresql', 'mariadb', 'sqlite3', ...) to the migration dialect.
 * Unknown drivers fall back to the permissive 'memory' dialect.
 */
export function toMigrationDialect(driverName: string | undefined): MigrationDialect {
  switch ((driverName ?? '').toLowerCase()) {
    case 'postgres':
    case 'postgresql':
    case 'pg':
      return 'postgres';
    case 'mysql':
    case 'mariadb':
      return 'mysql';
    case 'sqlite':
    case 'sqlite3':
    case 'better-sqlite3':
      return 'sqlite';
    case 'mongodb':
    case 'mongo':
      return 'mongodb';
    default:
      return 'memory';
  }
}

/**
 * Thrown by the compiler for SQLite operations that cannot be expressed with ALTER TABLE.
 * MigrationContext handles it by rebuilding the table from its live definition.
 */
export class SqliteRebuildRequired extends Error {
  public readonly operation: MigrationOperation;
  public readonly tableName: string;

  public constructor(operation: MigrationOperation, tableName: string) {
    super(
      `SQLite cannot apply '${operation.type}' to table '${tableName}' with ALTER TABLE; the table must be rebuilt.`
    );
    this.name = 'SqliteRebuildRequired';
    this.operation = operation;
    this.tableName = tableName;
  }
}

export class SqlMigrationCompiler {
  public readonly dialect: MigrationDialect;

  public constructor(dialect: MigrationDialect = 'memory') {
    this.dialect = dialect;
  }

  /**
   * Compiles an operation to SQL. Operations that need several statements (e.g. CREATE TABLE
   * followed by CREATE INDEX) are joined with newlines; use compileStatements() to execute them.
   */
  public compile(operation: MigrationOperation): string {
    return this.compileStatements(operation).join('\n');
  }

  /**
   * Compiles an operation into the ordered list of statements that implement it.
   * @throws SqliteRebuildRequired for SQLite operations that need a table rebuild.
   */
  public compileStatements(operation: MigrationOperation): string[] {
    if (operation instanceof CreateTableOperation) {
      return this.compileCreateTable(operation.table);
    }
    if (operation instanceof DropTableOperation) {
      return [`DROP TABLE ${this.quoteIdentifier(operation.tableName)};`];
    }
    if (operation instanceof AddColumnOperation) {
      return [this.compileAddColumn(operation)];
    }
    if (operation instanceof DropColumnOperation) {
      return [
        `ALTER TABLE ${this.quoteIdentifier(operation.tableName)} DROP COLUMN ${this.quoteIdentifier(operation.columnName)};`,
      ];
    }
    if (operation instanceof AlterColumnOperation) {
      return this.compileAlterColumn(operation);
    }
    if (operation instanceof RenameColumnOperation) {
      return [
        `ALTER TABLE ${this.quoteIdentifier(operation.tableName)} RENAME COLUMN ${this.quoteIdentifier(operation.oldName)} TO ${this.quoteIdentifier(operation.newName)};`,
      ];
    }
    if (operation instanceof RenameTableOperation) {
      if (this.dialect === 'mysql') {
        return [
          `RENAME TABLE ${this.quoteIdentifier(operation.oldName)} TO ${this.quoteIdentifier(operation.newName)};`,
        ];
      }
      return [
        `ALTER TABLE ${this.quoteIdentifier(operation.oldName)} RENAME TO ${this.quoteIdentifier(operation.newName)};`,
      ];
    }
    if (operation instanceof CreateIndexOperation) {
      return [this.compileCreateIndex(operation.tableName, operation.index)];
    }
    if (operation instanceof DropIndexOperation) {
      return [this.compileDropIndex(operation.tableName, operation.indexName)];
    }
    if (operation instanceof CreateUniqueConstraintOperation) {
      return [this.compileAddUnique(operation.tableName, operation.constraint)];
    }
    if (operation instanceof DropUniqueConstraintOperation) {
      return [this.compileDropUnique(operation.tableName, operation.constraintName)];
    }
    if (operation instanceof AddForeignKeyOperation) {
      if (this.dialect === 'sqlite') {
        throw new SqliteRebuildRequired(operation, operation.tableName);
      }
      return [
        `ALTER TABLE ${this.quoteIdentifier(operation.tableName)} ADD ${this.compileForeignKeyClause(operation.foreignKey)};`,
      ];
    }
    if (operation instanceof DropForeignKeyOperation) {
      if (this.dialect === 'sqlite') {
        throw new SqliteRebuildRequired(operation, operation.tableName);
      }
      const keyword = this.dialect === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT';
      return [
        `ALTER TABLE ${this.quoteIdentifier(operation.tableName)} DROP ${keyword} ${this.quoteIdentifier(operation.foreignKeyName)};`,
      ];
    }
    if (operation instanceof RawSqlOperation) {
      return [operation.upSql];
    }

    throw new MigrationError({
      message: `Unsupported migration operation type '${operation.type}'.`,
    });
  }

  public quoteIdentifier(identifier: string): string {
    if (!IDENTIFIER_REGEX.test(identifier)) {
      throw new MigrationError({
        message: `Invalid SQL identifier '${identifier}'. Identifiers must be alphanumeric and start with a letter or underscore.`,
      });
    }
    return this.dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
  }

  public mapType(type: ColumnType, col?: ColumnDefinition): string {
    const d = this.dialect;
    switch (type) {
      case 'string':
        return `VARCHAR(${col?.length ?? 255})`;
      case 'text':
        return d === 'mysql' ? 'LONGTEXT' : 'TEXT';
      case 'integer':
        return d === 'mysql' ? 'INT' : 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return d === 'sqlite' ? 'REAL' : d === 'mysql' ? 'DOUBLE' : 'DOUBLE PRECISION';
      case 'decimal':
        return `${d === 'mysql' ? 'DECIMAL' : 'NUMERIC'}(${col?.precision ?? 10}, ${col?.scale ?? 2})`;
      case 'boolean':
        return d === 'sqlite' ? 'INTEGER' : d === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN';
      case 'dateTime':
        return d === 'sqlite' ? 'DATETIME' : d === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP WITH TIME ZONE';
      case 'date':
        return 'DATE';
      case 'time':
        return 'TIME';
      case 'json':
        return d === 'postgres' ? 'JSONB' : d === 'sqlite' ? 'TEXT' : 'JSON';
      case 'uuid':
        return d === 'postgres' ? 'UUID' : d === 'mysql' ? 'CHAR(36)' : 'VARCHAR(36)';
      case 'binary':
        return d === 'postgres' ? 'BYTEA' : d === 'mysql' ? 'LONGBLOB' : 'BLOB';
      default:
        return 'TEXT';
    }
  }

  /**
   * Column definition SQL. `inlinePrimaryKey` is false when the table declares a composite
   * primary key, or when the column is being modified (MySQL MODIFY must not repeat PRIMARY KEY).
   */
  public compileColumnDef(col: ColumnDefinition, inlinePrimaryKey = true): string {
    const parts = [this.quoteIdentifier(col.name)];
    const d = this.dialect;
    const autoInc = col.autoIncrement === true;

    if (autoInc && d === 'postgres') {
      parts.push(col.type === 'bigint' ? 'BIGSERIAL' : 'SERIAL');
    } else if (autoInc && d === 'sqlite') {
      // SQLite only auto-increments a column declared exactly as INTEGER PRIMARY KEY.
      parts.push('INTEGER PRIMARY KEY AUTOINCREMENT');
    } else {
      parts.push(this.mapType(col.type, col));
    }

    const pkInline = col.primaryKey === true && inlinePrimaryKey && !(autoInc && d === 'sqlite');

    // PRIMARY KEY implies NOT NULL, except in SQLite where non-INTEGER keys may hold NULLs.
    const impliedNotNull = pkInline && d !== 'sqlite';
    if ((col.nullable === false || col.primaryKey === true) && !impliedNotNull) {
      if (!(autoInc && d === 'sqlite')) parts.push('NOT NULL');
    }

    if (autoInc && d === 'mysql') {
      parts.push('AUTO_INCREMENT');
    }

    if (pkInline) {
      parts.push('PRIMARY KEY');
    }

    if (col.defaultValue !== undefined && !autoInc) {
      parts.push(`DEFAULT ${this.formatDefault(col.defaultValue, col.type)}`);
    }

    return parts.join(' ');
  }

  public formatDefault(value: unknown, type?: ColumnType): string {
    let literal: string;
    if (value === null) {
      return 'NULL';
    } else if (typeof value === 'number' || typeof value === 'bigint') {
      literal = String(value);
    } else if (typeof value === 'boolean') {
      literal = this.dialect === 'sqlite' || this.dialect === 'mysql' ? (value ? '1' : '0') : value ? 'TRUE' : 'FALSE';
    } else if (value instanceof Date) {
      literal = `'${value.toISOString()}'`;
    } else if (typeof value === 'string') {
      literal = `'${value.replace(/'/g, "''")}'`;
    } else {
      literal = `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }

    // MySQL 8.0.13+ only accepts defaults for TEXT/JSON/BLOB columns as parenthesized expressions.
    if (this.dialect === 'mysql' && (type === 'json' || type === 'text' || type === 'binary')) {
      return `(${literal})`;
    }
    return literal;
  }

  /** Statements that create a table with its constraints and indexes. */
  public compileCreateTable(table: TableDefinition, tableNameOverride?: string): string[] {
    const name = this.quoteIdentifier(tableNameOverride ?? table.name);
    const pk = table.primaryKey ?? table.columns.filter((c) => c.primaryKey).map((c) => c.name);
    const composite = pk.length > 1;
    const body: string[] = table.columns.map((col) => this.compileColumnDef(col, !composite));

    if (composite) {
      body.push(`PRIMARY KEY (${pk.map((c) => this.quoteIdentifier(c)).join(', ')})`);
    }

    const uniques = table.uniqueConstraints ?? [];
    // SQLite unique constraints are created as unique indexes so they can be dropped later.
    if (this.dialect !== 'sqlite') {
      for (const uc of uniques) {
        body.push(
          `CONSTRAINT ${this.quoteIdentifier(uc.name)} UNIQUE (${uc.columns.map((c) => this.quoteIdentifier(c)).join(', ')})`
        );
      }
    }

    for (const fk of table.foreignKeys ?? []) {
      body.push(this.compileForeignKeyClause(fk));
    }

    const statements = [`CREATE TABLE ${name} (\n  ${body.join(',\n  ')}\n);`];
    const tableName = tableNameOverride ?? table.name;

    if (this.dialect === 'sqlite') {
      for (const uc of uniques) {
        statements.push(this.compileCreateIndex(tableName, { name: uc.name, columns: uc.columns, unique: true }));
      }
    }
    for (const idx of table.indexes ?? []) {
      statements.push(this.compileCreateIndex(tableName, idx));
    }
    return statements;
  }

  public compileForeignKeyClause(fk: ForeignKeyDefinition): string {
    const cols = fk.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const refCols = fk.referencedColumns.map((c) => this.quoteIdentifier(c)).join(', ');
    const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
    return `CONSTRAINT ${this.quoteIdentifier(fk.name)} FOREIGN KEY (${cols}) REFERENCES ${this.quoteIdentifier(fk.referencedTable)} (${refCols})${onDelete}${onUpdate}`;
  }

  private compileAddColumn(op: AddColumnOperation): string {
    const col = op.column;
    if (this.dialect === 'sqlite') {
      // ALTER TABLE ADD COLUMN cannot add a PRIMARY KEY column, or a NOT NULL column without a
      // non-null default.
      const notNullWithoutDefault =
        col.nullable === false && (col.defaultValue === undefined || col.defaultValue === null);
      if (col.primaryKey || col.autoIncrement || notNullWithoutDefault) {
        throw new SqliteRebuildRequired(op, op.tableName);
      }
    }
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} ADD COLUMN ${this.compileColumnDef(col)};`;
  }

  private compileAlterColumn(op: AlterColumnOperation): string[] {
    const table = this.quoteIdentifier(op.tableName);
    const col = op.column;
    const name = this.quoteIdentifier(col.name);

    if (this.dialect === 'sqlite') {
      throw new SqliteRebuildRequired(op, op.tableName);
    }

    if (this.dialect === 'mysql') {
      return [`ALTER TABLE ${table} MODIFY COLUMN ${this.compileColumnDef(col, false)};`];
    }

    if (this.dialect === 'postgres') {
      const clauses: string[] = [];
      const prev = op.previousColumn;
      const type = col.autoIncrement
        ? col.type === 'bigint'
          ? 'BIGINT'
          : 'INTEGER'
        : this.mapType(col.type, col);
      const prevType = prev.autoIncrement
        ? prev.type === 'bigint'
          ? 'BIGINT'
          : 'INTEGER'
        : this.mapType(prev.type, prev);

      if (type !== prevType) {
        clauses.push(`ALTER COLUMN ${name} TYPE ${type} USING ${name}::${type}`);
      }
      const wasNullable = prev.nullable !== false && prev.primaryKey !== true;
      const isNullable = col.nullable !== false && col.primaryKey !== true;
      if (wasNullable !== isNullable) {
        clauses.push(`ALTER COLUMN ${name} ${isNullable ? 'DROP' : 'SET'} NOT NULL`);
      }
      if (!defaultsEqual(prev.defaultValue, col.defaultValue) && !col.autoIncrement) {
        clauses.push(
          col.defaultValue === undefined
            ? `ALTER COLUMN ${name} DROP DEFAULT`
            : `ALTER COLUMN ${name} SET DEFAULT ${this.formatDefault(col.defaultValue, col.type)}`
        );
      }
      if (clauses.length === 0) {
        return [];
      }
      return [`ALTER TABLE ${table} ${clauses.join(', ')};`];
    }

    return [`ALTER TABLE ${table} ALTER COLUMN ${name} ${this.mapType(col.type, col)};`];
  }

  public compileCreateIndex(tableName: string, index: IndexDefinition): string {
    const unique = index.unique ? 'UNIQUE ' : '';
    const cols = index.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(index.name)} ON ${this.quoteIdentifier(tableName)} (${cols});`;
  }

  private compileDropIndex(tableName: string, indexName: string): string {
    if (this.dialect === 'mysql') {
      return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)};`;
    }
    return `DROP INDEX ${this.quoteIdentifier(indexName)};`;
  }

  private compileAddUnique(tableName: string, constraint: UniqueConstraintDefinition): string {
    if (this.dialect === 'sqlite') {
      return this.compileCreateIndex(tableName, { name: constraint.name, columns: constraint.columns, unique: true });
    }
    const cols = constraint.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(constraint.name)} UNIQUE (${cols});`;
  }

  private compileDropUnique(tableName: string, constraintName: string): string {
    if (this.dialect === 'sqlite') {
      return `DROP INDEX ${this.quoteIdentifier(constraintName)};`;
    }
    if (this.dialect === 'mysql') {
      return `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP INDEX ${this.quoteIdentifier(constraintName)};`;
    }
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP CONSTRAINT ${this.quoteIdentifier(constraintName)};`;
  }
}

function defaultsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
