import type { ColumnDefinition, ColumnType, TableDefinition } from '../public/types.js';
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

export type MigrationDialect = 'postgres' | 'sqlite' | 'mysql' | 'memory';

export class SqlMigrationCompiler {
  private readonly dialect: MigrationDialect;

  public constructor(dialect: MigrationDialect = 'memory') {
    this.dialect = dialect;
  }

  public compile(operation: MigrationOperation): string {
    if (operation instanceof CreateTableOperation) {
      return this.compileCreateTable(operation);
    }
    if (operation instanceof DropTableOperation) {
      return this.compileDropTable(operation);
    }
    if (operation instanceof AddColumnOperation) {
      return this.compileAddColumn(operation);
    }
    if (operation instanceof DropColumnOperation) {
      return this.compileDropColumn(operation);
    }
    if (operation instanceof AlterColumnOperation) {
      return this.compileAlterColumn(operation);
    }
    if (operation instanceof RenameColumnOperation) {
      return this.compileRenameColumn(operation);
    }
    if (operation instanceof RenameTableOperation) {
      return this.compileRenameTable(operation);
    }
    if (operation instanceof CreateIndexOperation) {
      return this.compileCreateIndex(operation);
    }
    if (operation instanceof DropIndexOperation) {
      return this.compileDropIndex(operation);
    }
    if (operation instanceof CreateUniqueConstraintOperation) {
      return this.compileCreateUniqueConstraint(operation);
    }
    if (operation instanceof DropUniqueConstraintOperation) {
      return this.compileDropUniqueConstraint(operation);
    }
    if (operation instanceof AddForeignKeyOperation) {
      return this.compileAddForeignKey(operation);
    }
    if (operation instanceof DropForeignKeyOperation) {
      return this.compileDropForeignKey(operation);
    }
    if (operation instanceof RawSqlOperation) {
      return operation.upSql;
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
    return `"${identifier}"`;
  }

  public mapType(type: ColumnType, col?: ColumnDefinition): string {
    switch (type) {
      case 'string':
        return `VARCHAR(${col?.length ?? 255})`;
      case 'text':
        return 'TEXT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return this.dialect === 'sqlite' ? 'REAL' : 'DOUBLE PRECISION';
      case 'decimal':
        return `NUMERIC(${col?.precision ?? 10}, ${col?.scale ?? 2})`;
      case 'boolean':
        return this.dialect === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
      case 'dateTime':
        return this.dialect === 'sqlite' ? 'DATETIME' : 'TIMESTAMP WITH TIME ZONE';
      case 'date':
        return 'DATE';
      case 'time':
        return 'TIME';
      case 'json':
        return this.dialect === 'postgres' ? 'JSONB' : this.dialect === 'sqlite' ? 'TEXT' : 'JSON';
      case 'uuid':
        return this.dialect === 'postgres' ? 'UUID' : 'VARCHAR(36)';
      case 'binary':
        return this.dialect === 'postgres' ? 'BYTEA' : 'BLOB';
      default:
        return 'TEXT';
    }
  }

  private compileColumnDef(col: ColumnDefinition, isTablePk = false): string {
    const parts = [this.quoteIdentifier(col.name)];

    if (col.autoIncrement && this.dialect === 'postgres') {
      parts.push(col.type === 'bigint' ? 'BIGSERIAL' : 'SERIAL');
    } else {
      parts.push(this.mapType(col.type, col));
      if (col.autoIncrement && this.dialect === 'sqlite') {
        parts.push('PRIMARY KEY AUTOINCREMENT');
      }
    }

    if (col.primaryKey && !isTablePk && !(col.autoIncrement && this.dialect === 'sqlite')) {
      parts.push('PRIMARY KEY');
    }

    if (col.nullable === false) {
      parts.push('NOT NULL');
    }

    if (col.defaultValue !== undefined) {
      parts.push(`DEFAULT ${this.formatDefault(col.defaultValue)}`);
    }

    return parts.join(' ');
  }

  private formatDefault(value: unknown): string {
    if (value === null) return 'NULL';
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  private compileCreateTable(op: CreateTableOperation): string {
    const table: TableDefinition = op.table;
    const body: string[] = [];

    const hasCompositePk = table.primaryKey && table.primaryKey.length > 1;

    for (const col of table.columns) {
      body.push(this.compileColumnDef(col, hasCompositePk));
    }

    if (hasCompositePk && table.primaryKey) {
      const quotedCols = table.primaryKey.map((c) => this.quoteIdentifier(c)).join(', ');
      body.push(`PRIMARY KEY (${quotedCols})`);
    }

    return `CREATE TABLE ${this.quoteIdentifier(table.name)} (\n  ${body.join(',\n  ')}\n);`;
  }

  private compileDropTable(op: DropTableOperation): string {
    return `DROP TABLE ${this.quoteIdentifier(op.tableName)};`;
  }

  private compileAddColumn(op: AddColumnOperation): string {
    const colDef = this.compileColumnDef(op.column);
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} ADD COLUMN ${colDef};`;
  }

  private compileDropColumn(op: DropColumnOperation): string {
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} DROP COLUMN ${this.quoteIdentifier(op.columnName)};`;
  }

  private compileAlterColumn(op: AlterColumnOperation): string {
    const table = this.quoteIdentifier(op.tableName);
    const col = this.quoteIdentifier(op.column.name);
    const type = this.mapType(op.column.type, op.column);

    if (this.dialect === 'postgres') {
      return `ALTER TABLE ${table} ALTER COLUMN ${col} TYPE ${type};`;
    }
    return `ALTER TABLE ${table} MODIFY COLUMN ${col} ${type};`;
  }

  private compileRenameColumn(op: RenameColumnOperation): string {
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} RENAME COLUMN ${this.quoteIdentifier(op.oldName)} TO ${this.quoteIdentifier(op.newName)};`;
  }

  private compileRenameTable(op: RenameTableOperation): string {
    return `ALTER TABLE ${this.quoteIdentifier(op.oldName)} RENAME TO ${this.quoteIdentifier(op.newName)};`;
  }

  private compileCreateIndex(op: CreateIndexOperation): string {
    const unique = op.index.unique ? 'UNIQUE ' : '';
    const indexName = this.quoteIdentifier(op.index.name);
    const tableName = this.quoteIdentifier(op.tableName);
    const cols = op.index.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `CREATE ${unique}INDEX ${indexName} ON ${tableName} (${cols});`;
  }

  private compileDropIndex(op: DropIndexOperation): string {
    return `DROP INDEX ${this.quoteIdentifier(op.indexName)};`;
  }

  private compileCreateUniqueConstraint(op: CreateUniqueConstraintOperation): string {
    const table = this.quoteIdentifier(op.tableName);
    const name = this.quoteIdentifier(op.constraint.name);
    const cols = op.constraint.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${cols});`;
  }

  private compileDropUniqueConstraint(op: DropUniqueConstraintOperation): string {
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} DROP CONSTRAINT ${this.quoteIdentifier(op.constraintName)};`;
  }

  private compileAddForeignKey(op: AddForeignKeyOperation): string {
    const table = this.quoteIdentifier(op.tableName);
    const name = this.quoteIdentifier(op.foreignKey.name);
    const cols = op.foreignKey.columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const refTable = this.quoteIdentifier(op.foreignKey.referencedTable);
    const refCols = op.foreignKey.referencedColumns.map((c) => this.quoteIdentifier(c)).join(', ');
    const onDelete = op.foreignKey.onDelete ? ` ON DELETE ${op.foreignKey.onDelete}` : '';
    const onUpdate = op.foreignKey.onUpdate ? ` ON UPDATE ${op.foreignKey.onUpdate}` : '';

    return `ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${cols}) REFERENCES ${refTable} (${refCols})${onDelete}${onUpdate};`;
  }

  private compileDropForeignKey(op: DropForeignKeyOperation): string {
    return `ALTER TABLE ${this.quoteIdentifier(op.tableName)} DROP CONSTRAINT ${this.quoteIdentifier(op.foreignKeyName)};`;
  }
}
